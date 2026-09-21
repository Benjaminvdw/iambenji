export default function Glare() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 9999,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(255,255,255,0.55) 100%)',
      }}
    />
  )
}
