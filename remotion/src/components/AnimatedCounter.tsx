import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  from: number;
  to: number;
  duration: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<Props> = ({
  from,
  to,
  duration,
  suffix = "",
  prefix = "",
  decimals = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const eased = interpolate(frame, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const value = from + (to - from) * eased;
  return (
    <span style={style}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
};
