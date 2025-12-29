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
            precision highp float;
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
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                uv.x *= u_resolution.x / u_resolution.y;

                float time = u_time * 0.2;
                
                // Mouse distortion
                vec2 m = u_mouse / u_resolution;
                m.x *= u_resolution.x / u_resolution.y;
                float d = distance(uv, m);
                float mouse_effect = smoothstep(0.5, 0.0, d) * 0.5;

                // Layered noise for "liquid" feel
                float n = snoise(uv * 1.8 + time) * 0.5;
                n += snoise(uv * 4.0 - time * 0.4) * 0.25;
                n += snoise(uv * 8.0 + time * 0.2) * 0.125;
                n += mouse_effect;

                // Normal estimation for fake reflection
                float eps = 0.005;
                float n_x = (snoise((uv + vec2(eps, 0.0)) * 1.8 + time) - n) / eps;
                float n_y = (snoise((uv + vec2(0.0, eps)) * 1.8 + time) - n) / eps;
                vec3 normal = normalize(vec3(-n_x, -n_y, 0.4)); // Sharper normals

                // Fake environment lighting
                vec3 light_dir = normalize(vec3(0.5, 0.8, 1.0));
                float spec = pow(max(dot(normal, light_dir), 0.0), 60.0); // Sharper highlights
                float diffuse = max(dot(normal, light_dir), 0.0) * 0.6;

                // Color palette (Chrome / Silver with user preference for terracotta tints)
                vec3 color_terracotta = vec3(0.95, 0.55, 0.4); // More vibrant
                vec3 color_chrome = vec3(0.02, 0.02, 0.05); // Deeper blacks
                
                vec3 final_color = mix(color_chrome, color_terracotta, diffuse * 0.4);
                final_color += spec * 0.8; // Stronger glossy highlights
                
                // Fresnel effect for edge depth
                float fresnel = pow(1.0 - normal.z, 2.5);
                final_color += fresnel * color_terracotta * 0.6;

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
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = window.innerHeight - e.clientY;
        });

        const render = (time: number) => {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform1f(timeLocation, time * 0.001);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform2f(mouseLocation, mouseX, mouseY);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            requestAnimationFrame(render);
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', handleResize);
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
