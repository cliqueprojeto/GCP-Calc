export function Logo({ size = 32 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} width={size} height={size} alt="GCP-Calc" className="logo" draggable={false} />;
}
