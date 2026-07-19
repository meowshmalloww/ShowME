export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="brand-mark" height={size} viewBox="0 0 32 32" width={size}>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      >
        <path d="M4.5 11V4.5H11" />
        <path d="M21 4.5h6.5V11" />
        <path d="M4.5 21v6.5H11" />
        <path d="M21 27.5h6.5V21" />
      </g>
      <path d="M12.6 9.5h5.2l3.6 3.6v5.1l-8.8 3.1V9.5Z" fill="currentColor" />
      <path d="m13.1 22 5.5-2.9v5.6L13.1 22Z" fill="currentColor" />
    </svg>
  );
}
