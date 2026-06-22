export default function FishIcon({ color = '#1B6E8C', faceColor = '#0A2540', className, style }) {
  return (
    <svg
      viewBox="0 0 526 253"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="Stinky fish icon"
    >
      <path
        d="M305.073 0C424.367 6.52008e-05 521.073 56.636 521.073 126.5C521.073 196.364 424.367 253 305.073 253C229.273 253 162.595 230.131 124.048 195.534C87.8086 197.084 56.1567 204.154 19.6233 217.257C7.86006 221.476 -2.73881 207.29 5.0979 197.556L57.679 132.242C61.2159 127.849 61.2159 121.585 57.679 117.191L2.69653 48.8955C-4.97804 39.3626 5.00581 25.5026 16.6311 29.3271C57.7524 42.8556 91.8941 49.9051 130.841 51.7197C170.152 20.3591 233.553 0 305.073 0Z"
        fill={color}
      />
      <path
        d="M323.836 108.877C288.215 123.654 240.722 158.205 335.717 178.197"
        stroke={faceColor}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M408.074 91L444.074 127" stroke={faceColor} strokeWidth="9" strokeLinecap="round" />
      <path d="M444.074 91L408.074 127" stroke={faceColor} strokeWidth="9" strokeLinecap="round" />
      <path
        d="M466.074 166C472.24 155 491.774 133 520.574 133"
        stroke={faceColor}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
