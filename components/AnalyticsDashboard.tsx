import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { format, parseISO, startOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { Event, Registration, RegistrationStatus } from '../types';
import { Users, TrendingUp, CalendarCheck, Activity } from 'lucide-react';

interface AnalyticsDashboardProps {
    events: Event[];
    registrations: Registration[];
}

const COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b']; // Indigo, Green, Red, Amber

export default function AnalyticsDashboard({ events, registrations }: AnalyticsDashboardProps) {

    // --- KPI Cards ---
    const totalRegistrations = registrations.length;
    const totalEvents = events.length;
    const totalApprovals = registrations.filter(r => r.status === RegistrationStatus.APPROVED).length;
    const averageAttendance = useMemo(() => {
        const attended = registrations.filter(r => r.attended).length;
        return totalApprovals > 0 ? Math.round((attended / totalApprovals) * 100) : 0;
    }, [registrations, totalApprovals]);


    // --- Chart 1: Registrations Over Time (Last 14 Days) ---
    const timeSeriesData = useMemo(() => {
        const end = startOfDay(new Date());
        const start = subDays(end, 13); // Last 14 days including today
        const days = eachDayOfInterval({ start, end });

        // Initialize counts
        const counts: Record<string, number> = {};
        days.forEach(day => {
            counts[format(day, 'yyyy-MM-dd')] = 0;
        });

        // Populate counts
        registrations.forEach(reg => {
            const dateKey = format(parseISO(reg.registeredAt), 'yyyy-MM-dd');
            if (counts.hasOwnProperty(dateKey)) {
                counts[dateKey]++;
            }
        });

        return days.map(day => ({
            date: format(day, 'MMM dd'),
            count: counts[format(day, 'yyyy-MM-dd')]
        }));
    }, [registrations]);


    // --- Chart 2: Status Distribution ---
    const statusData = useMemo(() => {
        const counts = {
            [RegistrationStatus.PENDING]: 0,
            [RegistrationStatus.APPROVED]: 0,
            [RegistrationStatus.REJECTED]: 0,
            [RegistrationStatus.WAITLISTED]: 0,
        };

        registrations.forEach(r => {
            if (counts[r.status] !== undefined) counts[r.status]++;
        });

        return [
            { name: 'Pending', value: counts[RegistrationStatus.PENDING] },
            { name: 'Approved', value: counts[RegistrationStatus.APPROVED] },
            { name: 'Rejected', value: counts[RegistrationStatus.REJECTED] },
            { name: 'Waitlisted', value: counts[RegistrationStatus.WAITLISTED] },
        ].filter(d => d.value > 0);
    }, [registrations]);


    // --- Chart 3: Top 5 Events by Popularity ---
    const popularityData = useMemo(() => {
        const eventCounts: Record<string, number> = {};
        registrations.forEach(r => {
            eventCounts[r.eventId] = (eventCounts[r.eventId] || 0) + 1;
        });

        return Object.entries(eventCounts)
            .map(([eventId, count]) => {
                const event = events.find(e => e.id === eventId);
                return {
                    name: event ? (event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title) : 'Unknown',
                    registrations: count
                };
            })
            .sort((a, b) => b.registrations - a.registrations)
            .slice(0, 5);
    }, [events, registrations]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-semibold">Total Registrations</p>
                        <p className="text-2xl font-bold text-white font-outfit">{totalRegistrations}</p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <CalendarCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-semibold">Total Events</p>
                        <p className="text-2xl font-bold text-white font-outfit">{totalEvents}</p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-semibold">Approval Rate</p>
                        <p className="text-2xl font-bold text-white font-outfit">
                            {totalRegistrations > 0 ? Math.round((totalApprovals / totalRegistrations) * 100) : 0}%
                        </p>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-semibold">Avg. Attendance</p>
                        <p className="text-2xl font-bold text-white font-outfit">{averageAttendance}%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Registrations Trend */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6 font-outfit">Registration Trend (14 Days)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeSeriesData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                                    itemStyle={{ color: '#818cf8' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6 font-outfit">Registration Status</h3>
                    <div className="h-64 w-full flex justify-center items-center">
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-slate-500">No data available</p>
                        )}
                    </div>
                </div>

                {/* Popular Events */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-2">
                    <h3 className="text-lg font-bold text-white mb-6 font-outfit">Top Events by Registrations</h3>
                    <div className="h-64 w-full">
                        {popularityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={popularityData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                    <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip
                                        cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                                    />
                                    <Bar dataKey="registrations" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-slate-500 text-center pt-20">No event data available</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
