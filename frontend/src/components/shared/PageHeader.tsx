interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, count, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-shop-2xl font-bold text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-shop-base font-normal text-gray-500">{count}건</span>
          )}
        </h1>
        {description && <p className="mt-1 text-shop-sm text-gray-500">{description}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
