import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { PersistentBg } from "./components/PersistentBg";
import { Hook } from "./scenes/Hook";
import { BrandReveal } from "./scenes/BrandReveal";
import { Modules } from "./scenes/Modules";
import { Kpis } from "./scenes/Kpis";
import { RouteScene } from "./scenes/Route";
import { Cta } from "./scenes/Cta";

// Total 1800 frames = 60s @ 30fps
// 180 + 240 + 360 + 360 + 360 + 300 = 1800
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBg />
      <Series>
        <Series.Sequence durationInFrames={180}>
          <Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={240}>
          <BrandReveal />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <Modules />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <Kpis />
        </Series.Sequence>
        <Series.Sequence durationInFrames={360}>
          <RouteScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={300}>
          <Cta />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
