interface ComingSoonProps {
  title: string
}

export function ComingSoonView({ title }: ComingSoonProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-display text-2xl text-text mb-2">{title}</h1>
        <p className="text-muted">Coming soon</p>
      </div>
    </div>
  )
}
