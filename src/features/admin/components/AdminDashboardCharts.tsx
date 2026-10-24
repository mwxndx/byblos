import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';



const COLORS = ['#facc15', '#e5e5e5', '#737373', '#d4d4d4', '#f59e0b', '#a3a3a3'];

const hasChartData = (data: Record<string, unknown>[] = []) =>
  data.some(item =>
    Object.values(item || {}).some(value => typeof value === 'number' && value > 0)
  );

export const ChartContainer = ({ title, description, children, className = '' }: { title: string, description: string, children: ReactNode, className?: string }) => (
  <Card className={`${className} bg-surface-1 border border-separator shadow-xl rounded-2xl overflow-hidden group hover:border-yellow-500/30 transition-all duration-300`}>
    <CardHeader className="relative z-10 pb-2">
      <CardTitle className="text-xl font-semibold text-label transition-colors">{title}</CardTitle>
      <CardDescription className="text-label-2 font-medium">{description}</CardDescription>
    </CardHeader>
    <CardContent className="relative z-10 h-[350px] w-full pt-4">
      {children}
    </CardContent>
  </Card>
);

export const UserGrowthChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="User Growth" description="New buyers, sellers, and creators growth trend" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <defs>
          <linearGradient id="colorBuyers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSellers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCreators" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#f5f5f5' }}
          itemStyle={{ color: '#f5f5f5', fontSize: '12px' }}
        />
        <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
        <Line type="monotone" dataKey="buyers" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Buyers" />
        <Line type="monotone" dataKey="sellers" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Sellers" />
        <Line type="monotone" dataKey="creators" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#0A0A0A' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Creators" />
      </LineChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const RevenueChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="Revenue Trends" description="Monthly platform earnings (KSh)" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis
          stroke="#6b7280"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          fontSize={12}
          fontWeight={500}
          tickFormatter={(val) => {
            const num = Number(val || 0);
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
            return `${num}`;
          }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(250, 204, 21, 0.08)' }}
          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
          itemStyle={{ color: '#f5f5f5' }}
          formatter={(value) => [`KES ${Number(value || 0).toLocaleString()}`, 'Revenue']}
        />
        <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} name="Revenue (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const SalesChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="Sales Volume" description="Total marketplace transaction volume" className="col-span-4 lg:col-span-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} fontWeight={500} />
        <YAxis
          stroke="#6b7280"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          fontSize={12}
          fontWeight={500}
          tickFormatter={(val) => {
            const num = Number(val || 0);
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
            return `${num}`;
          }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(250, 204, 21, 0.08)' }}
          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
          itemStyle={{ color: '#f5f5f5' }}
          formatter={(value) => [`KES ${Number(value || 0).toLocaleString()}`, 'Sales Volume']}
        />
        <Bar dataKey="sales" fill="url(#colorSales)" radius={[8, 8, 0, 0]} name="Sales (KSh)" barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
);

export const ProductStatusChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="Product Distribution" description="Product mix by catalog type" className="col-span-4 lg:col-span-2">
    {hasChartData(data) ? (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={74}
            outerRadius={108}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#f5f5f5' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    ) : (
      <div className="flex h-full items-center justify-center text-center">
        <p className="text-sm font-semibold text-label-3">No catalog distribution yet</p>
      </div>
    )}
  </ChartContainer>
);

export const GeoDistributionChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="Geographic Reach" description="Regions by GMV, buyers, sellers, and creators" className="col-span-4 lg:col-span-2">
    {hasChartData(data) ? (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
          <XAxis type="number" stroke="#6b7280" axisLine={false} tickLine={false} fontSize={12} />
          <YAxis type="category" dataKey="name" width={96} stroke="#9ca3af" axisLine={false} tickLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: 'rgba(250, 204, 21, 0.08)' }}
            contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#f5f5f5' }}
            formatter={(value, name) => {
              if (name === 'GMV') return [`KES ${Number(value || 0).toLocaleString()}`, String(name)];
              return [Number(value || 0).toLocaleString(), String(name)];
            }}
          />
          <Legend />
          <Bar dataKey="buyers" fill="#38bdf8" radius={[0, 8, 8, 0]} name="Buyers" />
          <Bar dataKey="sellers" fill="#22c55e" radius={[0, 8, 8, 0]} name="Sellers" />
          <Bar dataKey="creators" fill="#a855f7" radius={[0, 8, 8, 0]} name="Creators" />
          <Bar dataKey="gmv" fill="#f59e0b" radius={[0, 8, 8, 0]} name="GMV" />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <div className="flex h-full items-center justify-center text-center">
        <p className="text-sm font-semibold text-label-3">No geographic activity yet</p>
      </div>
    )}
  </ChartContainer>
);

export const CategoryDistributionChart = ({ data }: { data: Record<string, unknown>[] }) => (
  <ChartContainer title="Category Distribution" description="Product mix by product category" className="col-span-4 lg:col-span-2">
    {hasChartData(data) ? (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={74}
            outerRadius={108}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#f5f5f5' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    ) : (
      <div className="flex h-full items-center justify-center text-center">
        <p className="text-sm font-semibold text-label-3">No category distribution yet</p>
      </div>
    )}
  </ChartContainer>
);


