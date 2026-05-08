import React from "react";

export default function SectionCard({
  title,
  badge,
  accentColor = "bg-blue-500",
  children,
  className = "",
}) {
  return (
    <section className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <span className={`w-1.5 h-4 rounded-sm ${accentColor}`} />
          <h2 className="text-sm font-semibold text-slate-200 flex-1">{title}</h2>
          {badge && (
            <span className="text-[10px] font-mono text-slate-600 border border-slate-700 px-2 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
