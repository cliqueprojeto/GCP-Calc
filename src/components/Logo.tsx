export function Logo({ size = 32 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="GCP-Calc" className="logo" draggable={false} />;
}
