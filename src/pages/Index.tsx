import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Briefcase,
  Upload,
  CheckCircle2,
  Package,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  Zap,
  Trash2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { format, subMonths, isBefore } from 'date-fns';

const Dashboard = () => {
  const { appUser } = useAuth();
  const firstName = appUser?.full_name?.split(' ')[0] || 'John';

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-v7-live-stats'],
    queryFn: async () => {
      const today = new Date();

      const [
        { count: inHand },
        { count: uploaded },
        { count: activeWorkflow },
        { count: closed },
        { count: rejected },
        { data: allCases },
        { data: invoices },
        { count: inDepthCount },
        { count: enforcementCount },
        { count: destructionCount },
        { data: recentCases }
      ] = await Promise.all([
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('case_status', 'IN_HAND'),
        supabase.from('cases').select('*', { count: 'exact', head: true }).neq('case_status', 'IN_HAND'), // Uploaded = everything except IN_HAND
        supabase.from('cases').select('*', { count: 'exact', head: true }).in('case_status', ['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED']),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('case_status', 'CLOSED'), // Closed is just CLOSED
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('case_status', 'REJECTED'),
        supabase.from('cases').select('case_reported_date, province, case_status, created_at'),
        supabase.from('invoices').select('amount_usd, status, due_date, created_at'),
        supabase.from('in_depth_stages').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
        supabase.from('enforcement_stages').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
        supabase.from('destruction_stages').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
        supabase.from('cases').select('case_id, case_status, created_at').order('created_at', { ascending: false }).limit(5)
      ]);

      // 1. Generate Last 7 Months Labels
      const months = Array.from({ length: 7 }).map((_, i) => format(subMonths(today, 6 - i), 'MMM'));

      // 2. Process Trend Data
      const trendData = months.map(month => {
        const monthCases = allCases?.filter(c => format(new Date(c.case_reported_date || c.created_at), 'MMM') === month) || [];
        return {
          name: month,
          NewCases: monthCases.length,
          Resolved: monthCases.filter(c => c.case_status === 'CLOSED').length
        };
      });

      // 3. Status Distribution (Pie)
      const statusChartData = [
        { name: 'In-Hand', value: inHand || 0, color: '#64748b' },
        { name: 'Approved', value: activeWorkflow || 0, color: '#22c55e' },
        { name: 'Closed', value: closed || 0, color: '#a855f7' },
        { name: 'Uploaded', value: uploaded || 0, color: '#3b82f6' },
        { name: 'Rejected', value: rejected || 0, color: '#ef4444' }
      ];

      // 4. Province Data (Top 6)
      const provinceMap: Record<string, number> = {};
      allCases?.forEach(c => { if (c.province) provinceMap[c.province] = (provinceMap[c.province] || 0) + 1; });
      const provinceData = Object.entries(provinceMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // 5. Revenue Tracking
      const revenueData = months.map(month => {
        const monthInvoices = invoices?.filter(inv => format(new Date(inv.created_at), 'MMM') === month) || [];
        return {
          name: month,
          Invoiced: monthInvoices.reduce((sum, i) => sum + (i.amount_usd || 0), 0),
          Collected: monthInvoices.filter(inv => inv.status === 'PAID').reduce((sum, i) => sum + (i.amount_usd || 0), 0)
        };
      });

      // 6. Overdue Stats
      const totalOutstanding = invoices?.filter(inv => inv.status !== 'PAID').reduce((sum, i) => sum + (i.amount_usd || 0), 0) || 0;
      const overdueInvoices = invoices?.filter(inv =>
        inv.status === 'OVERDUE' ||
        (inv.status === 'NOT_PAID' && inv.due_date && isBefore(new Date(inv.due_date), today))
      ) || [];
      const overdueCount = overdueInvoices.length;

      // 7. Recent Activity Labels
      const activity = recentCases?.map(c => ({
        label: `${c.case_id} ${c.case_status.toLowerCase().replace('_', ' ')}`,
        time: format(new Date(c.created_at), 'MMM dd'),
        color: c.case_status === 'CLOSED' ? 'bg-green-500' : c.case_status === 'REJECTED' ? 'bg-red-500' : 'bg-blue-500'
      })) || [];

      return {
        stats: { inHand, uploaded, approved: activeWorkflow, closed, rejected },
        workflow: { inDepth: inDepthCount, enforcement: enforcementCount, destruction: destructionCount },
        totalOutstanding,
        overdueCount,
        trendData,
        statusChartData,
        provinceData,
        revenueData,
        activity
      };
    }
  });

  if (isLoading) return <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/4" /><div className="grid grid-cols-4 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-[300px]" /></div>;

  return (
    <div className="space-y-4 pb-6 overflow-x-hidden">
      {/* Header */}
      <div className="space-y-0.5 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, <span className="text-blue-500">{firstName}</span>
        </h1>
        <p className="text-muted-foreground text-xs font-light">Here's what's happening with your operations today.</p>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'In-Hand', val: dashboardData?.stats.inHand, icon: Briefcase, color: 'text-blue-400', iconBg: 'bg-[#1e293b]' },
          { label: 'Uploaded', val: dashboardData?.stats.uploaded, icon: Upload, color: 'text-blue-400', iconBg: 'bg-[#1e293b]' },
          { label: 'Approved', val: dashboardData?.stats.approved, icon: CheckCircle2, color: 'text-green-400', iconBg: 'bg-[#1e293b]' },
          { label: 'Closed', val: dashboardData?.stats.closed, icon: Package, color: 'text-purple-400', iconBg: 'bg-[#1e293b]' },
        ].map((item, i) => (
          <Card key={i} className="bg-[#0f172a] border-none shadow-lg rounded-xl overflow-hidden">
            <CardContent className="p-4 py-5 font-sans">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold font-sans">{item.label}</p>
                  <h3 className="text-3xl font-extrabold text-white font-sans">{item.val || 0}</h3>
                </div>
                <div className={`p-2 rounded-lg ${item.iconBg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Cases Trend */}
        <Card className="lg:col-span-8 bg-[#0f172a] border-none rounded-xl shadow-lg">
          <CardHeader className="p-4 pb-0 flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Cases Trend (6 Months)</span>
          </CardHeader>
          <CardContent className="h-[280px] p-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData?.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNewCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#ffffff05" />
                <XAxis dataKey="name" axisLine={{ stroke: '#4b5563' }} tickLine={false} tick={{ fill: '#4b5563', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                <Area type="monotone" dataKey="NewCases" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNewCases)" strokeWidth={2} />
                <Area type="monotone" dataKey="Resolved" stroke="#10b981" fillOpacity={1} fill="url(#colorResolved)" strokeWidth={2} />
                <Legend iconType="circle" verticalAlign="bottom" height={20} wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="lg:col-span-4 bg-[#0f172a] border-none rounded-xl shadow-lg">
          <CardHeader className="p-4 pb-0 flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Status Distribution</span>
          </CardHeader>
          <CardContent className="h-[280px] p-4 pt-2 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={dashboardData?.statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {dashboardData?.statusChartData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1 mt-4 px-2">
              {dashboardData?.statusChartData?.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="text-white font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cases by Province */}
        <Card className="bg-[#0f172a] border-none rounded-xl shadow-lg">
          <CardHeader className="p-4 pb-0">
            <span className="text-sm font-bold text-white font-sans">Cases by Province</span>
          </CardHeader>
          <CardContent className="h-[240px] p-4 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData?.provinceData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff10" />
                <XAxis type="number"
                  axisLine={{ stroke: '#4b5563', strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                  {dashboardData?.provinceData?.map((_, i) => (
                    <Cell key={i} fill="url(#matchedBarGradient)" />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="matchedBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Tracking */}
        <Card className="bg-[#0f172a] border-none rounded-xl shadow-lg">
          <CardHeader className="p-4 pb-0 flex flex-row items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-sm font-bold text-white font-sans">Revenue Tracking</span>
          </CardHeader>
          <CardContent className="h-[240px] p-4 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardData?.revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="Invoiced"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="Collected"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }}
                />
                <Legend iconType="circle" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '15px' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Workflow Summary */}
        <Card className="bg-[#0f172a] border-none rounded-xl">
          <CardHeader className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="h-4 w-4" />
              <span className="text-white text-xs font-semibold">Due This Week</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {[
              { label: 'In-Depth', icon: Search, count: dashboardData?.workflow.inDepth },
              { label: 'Enforcement', icon: Zap, count: dashboardData?.workflow.enforcement },
              { label: 'Destruction', icon: Trash2, count: dashboardData?.workflow.destruction }
            ].map((item, i) => (
              <div key={i} className="bg-[#1e293b]/30 p-2 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-[11px] font-sans">{item.label}</span>
                </div>
                <span className="text-blue-400 text-xs font-bold font-sans">{item.count || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Overdue Total */}
        <Card className="bg-[#0f172a] border-none rounded-xl">
          <CardHeader className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-red-500">
              <DollarSign className="h-4 w-4" />
              <span className="text-white text-xs font-semibold">Overdue Invoices</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-bold text-white font-sans">${dashboardData?.totalOutstanding.toLocaleString()}</h2>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-tighter font-sans">Total Outstanding</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <div>
                  <p className="text-white font-bold text-lg font-sans">{dashboardData?.overdueCount || 0}</p>
                  <p className="text-muted-foreground text-[8px] uppercase tracking-wider font-semibold font-sans">Overdue Count</p>
                </div>
                <div>
                  <p className="text-white font-bold text-lg font-sans">14</p>
                  <p className="text-muted-foreground text-[8px] uppercase tracking-wider font-semibold font-sans">Avg Days Overdue</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Live */}
        <Card className="bg-[#0f172a] border-none rounded-xl">
          <CardHeader className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-blue-400">
              <Package className="h-4 w-4" />
              <span className="text-white text-xs font-semibold">Recent Activity</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {dashboardData?.activity.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic text-center py-4">No recent activity</p>
            ) : (
              dashboardData?.activity.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] group">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground group-hover:text-white transition-colors font-sans">{item.label}</span>
                  </div>
                  <span className="text-muted-foreground/40 text-[9px] font-sans">{item.time}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
