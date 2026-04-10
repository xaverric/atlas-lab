import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-4 px-8 py-5">
      <h1 className="text-[28px] font-semibold" style={{ lineHeight: '1.14', letterSpacing: '0.196px' }}>{title}</h1>
      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </div>
  )
}
