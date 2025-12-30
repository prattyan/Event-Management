import React, { useEffect, useRef } from 'react';

const LiquidChrome = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { antialias: true });
        if (!gl) {
            console.error("WebGL not supported");
            return;
        }

        const vertexShaderSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;

            // Simplex noise by Ashima Arts
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ;
                m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            void main() {
                // Normalized pixel coordinates (from 0 to 1)
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                uv.x *= u_resolution.x / u_resolution.y;

                float time = u_time * 0.1; // Slowed down for elegance
                
                // Mouse interaction (Softened)
                vec2 m = u_mouse / u_resolution;
                m.x *= u_resolution.x / u_resolution.y;
                float d = distance(uv, m);
                float mouse_effect = smoothstep(0.4, 0.0, d) * 0.3; // Subtler interaction

                // Layered noise
                float n = snoise(uv * 1.5 + time) * 0.5;
                n += snoise(uv * 3.0 - time * 0.5) * 0.25;
                n += mouse_effect;

                // Color Palette: Deep Space + Molten Gold/Orange
                vec3 color_deep = vec3(0.01, 0.03, 0.08); // Midnight Blue/Black
                vec3 color_accent = vec3(0.85, 0.35, 0.15); // Burnt Orange
                vec3 color_highlight = vec3(1.0, 0.7, 0.3); // Soft Gold

                // Mixing logic based on noise
                float mix_val = smoothstep(-0.2, 0.8, n);
                vec3 final_color = mix(color_deep, color_accent, mix_val * 0.6);
                
                // Add highlights
                float highlight_mix = smoothstep(0.4, 1.0, n);
                final_color = mix(final_color, color_highlight, highlight_mix * 0.4);

                gl_FragColor = vec4(final_color, 1.0);
            }
        `;

        const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const program = gl.createProgram();
        if (!program) return;
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vertexShader || !fragmentShader) return;

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const timeLocation = gl.getUniformLocation(program, 'u_time');
        const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        const mouseLocation = gl.getUniformLocation(program, 'u_mouse');

        let mouseX = 0;
        let mouseY = 0;

        // Passive event listener for better scrolling performance
        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX * 0.5; // Scale to match canvas
            mouseY = (window.innerHeight - e.clientY) * 0.5;
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        const render = (time: number) => {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform1f(timeLocation, time * 0.001);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform2f(mouseLocation, mouseX, mouseY);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestAnimationFrame(render);
        };

        const handleResize = () => {
            // Optimization: Render at 50% resolution
            // This massively reduces GPU load (4x fewer pixels to shade)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = (window.innerWidth * dpr) * 0.5;
            canvas.height = (window.innerHeight * dpr) * 0.5;
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 -z-10 w-full h-full pointer-events-none opacity-40"
        />
    );
};

export default LiquidChrome;
