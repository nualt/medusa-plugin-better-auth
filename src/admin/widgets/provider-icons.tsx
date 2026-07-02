import { getProviderDisplay, type ProviderIconSpec } from "../../ui/provider-icons"

const iconClass = "size-4 shrink-0"

function IconSvg({ spec, className = iconClass }: { spec: ProviderIconSpec; className?: string }) {
  const monochrome = spec.paths.every((p) => !p.fill)
  return (
    <svg
      aria-hidden="true"
      viewBox={spec.viewBox}
      className={className}
      {...(monochrome ? { fill: "currentColor" } : {})}
    >
      {spec.paths.map((p, i) => (
        <path key={i} d={p.d} {...(p.fill ? { fill: p.fill } : {})} />
      ))}
    </svg>
  )
}

export function ProviderIcon({ provider, className = iconClass }: { provider: string; className?: string }) {
  const { label, icon } = getProviderDisplay(provider)
  if (icon) return <IconSvg spec={icon} className={className} />
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ui-bg-component text-[9px] font-semibold"
    >
      {label.charAt(0)}
    </span>
  )
}

export { getProviderDisplay }
