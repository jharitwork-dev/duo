/* eslint-disable @next/next/no-img-element -- decorative Figma SVGs, sized by their container */
import type { CSSProperties } from 'react';

// Decorative Cocoon shapes (book, rocket, target, lightbulb / star, puzzle, briefcase, heads)
// taken from the Figma "Iphone" frames. Positions are percentages of a 402×874 artboard.
// The left and right halves are anchored to their own viewport edge, so on a phone they
// line up exactly like Figma and on desktop they frame the content instead of sitting under it.

interface ShapeProps {
  inset: string;
  src: string;
  rotate?: string;
  w?: string;
  h?: string;
  bleed?: string;
}

function Shape({ inset, src, rotate, w, h, bleed }: ShapeProps) {
  const img = bleed ? (
    <div className="absolute" style={{ inset: bleed }}>
      <img alt="" className="block size-full max-w-none" src={src} />
    </div>
  ) : (
    <img alt="" className="absolute inset-0 block size-full max-w-none" src={src} />
  );

  if (!rotate) {
    return (
      <div className="absolute" style={{ inset }}>
        {img}
      </div>
    );
  }

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{ inset, containerType: 'size' } as CSSProperties}
    >
      <div className="flex-none" style={{ width: w, height: h, rotate }}>
        <div className="relative size-full">{img}</div>
      </div>
    </div>
  );
}

const f = (name: string) => `/figma/${name}`;

function LeftShapes() {
  return (
    <>
      {/* Book + pencil */}
      <Shape inset="85.86% 71.5% -2.77% -8.96%" src={f('cbd85.svg')} rotate="28.39deg" w="hypot(66.3124cqw, 36.5037cqh)" h="hypot(-33.6876cqw, 63.4963cqh)" />
      <Shape inset="90% 72.33% 1.14% 11.13%" src={f('f5846.svg')} rotate="28.39deg" w="hypot(52.3263cqw, 24.2743cqh)" h="hypot(-47.6737cqw, 75.7257cqh)" />
      <Shape inset="91.29% 90.52% 5.56% 0.95%" src={f('02d04.svg')} rotate="28.39deg" w="hypot(80.0197cqw, 53.9099cqh)" h="hypot(-19.9803cqw, 46.0901cqh)" bleed="-12.19% -5.63%" />
      <Shape inset="92.48% 91.71% 4.37% -0.25%" src={f('0c852.svg')} rotate="28.39deg" w="hypot(80.0198cqw, 53.91cqh)" h="hypot(-19.9802cqw, 46.09cqh)" bleed="-12.19% -5.63%" />
      <Shape inset="93.61% 93.1% 3.24% -1.64%" src={f('d8053.svg')} rotate="28.39deg" w="hypot(80.0198cqw, 53.91cqh)" h="hypot(-19.9802cqw, 46.09cqh)" bleed="-12.19% -5.63%" />

      {/* Rocket */}
      <Shape inset="38.48% 85.61% 51.34% -7.74%" src={f('466ff.svg')} rotate="8.63deg" w="hypot(86.8067cqw, 13.1662cqh)" h="hypot(-13.1933cqw, 86.8338cqh)" />
      <Shape inset="43.09% 97.38% 51.41% -9.33%" src={f('3f4d1.svg')} rotate="8.63deg" w="hypot(86.8054cqw, 13.1649cqh)" h="hypot(-13.1946cqw, 86.8351cqh)" />
      <Shape inset="46.42% 94.1% 49.28% -4.09%" src={f('93001.svg')} rotate="8.63deg" w="hypot(87.8108cqw, 14.2378cqh)" h="hypot(-12.1892cqw, 85.7622cqh)" />
      <Shape inset="40.86% 103.05% 54.55% -12.44%" src={f('3d67c.svg')} rotate="8.63deg" w="hypot(85.8181cqw, 12.2383cqh)" h="hypot(-14.1819cqw, 87.7617cqh)" />
      <Shape inset="41.34% 91.39% 55.31% 1.34%" src={f('d7794.svg')} rotate="8.63deg" w="hypot(86.8232cqw, 13.1827cqh)" h="hypot(-13.1768cqw, 86.8173cqh)" />
      <Shape inset="45.86% 104.65% 50.27% -13.06%" src={f('81842.svg')} rotate="8.63deg" w="hypot(86.8344cqw, 13.194cqh)" h="hypot(-13.1656cqw, 86.806cqh)" />
      <Shape inset="46.98% 103.02% 49.96% -9.68%" src={f('0f974.svg')} rotate="8.63deg" w="hypot(86.8034cqw, 13.1629cqh)" h="hypot(-13.1966cqw, 86.8371cqh)" />
      <Shape inset="44.95% 106.27% 51.99% -12.93%" src={f('0bb99.svg')} rotate="8.63deg" w="hypot(86.8067cqw, 13.1663cqh)" h="hypot(-13.1933cqw, 86.8337cqh)" />

      {/* Target */}
      <Shape inset="66.42% 84.95% 21.26% -13.63%" src={f('987f9.svg')} rotate="36.51deg" w="hypot(68.3158cqw, 54.1654cqh)" h="hypot(-31.6842cqw, 45.8346cqh)" />
      <Shape inset="66.48% 88.78% 30.1% 4.34%" src={f('867e9.svg')} rotate="36.51deg" w="hypot(44.0932cqw, 30.1809cqh)" h="hypot(-55.9068cqw, 69.8191cqh)" />
      <Shape inset="64.72% 98.48% 31.63% -6.42%" src={f('3b971.svg')} rotate="36.51deg" w="hypot(57.4604cqw, 42.5397cqh)" h="hypot(-42.5396cqw, 57.4603cqh)" />
      <Shape inset="70.43% 81.7% 25.92% 10.36%" src={f('b579c.svg')} rotate="36.51deg" w="hypot(57.4519cqw, 42.5311cqh)" h="hypot(-42.5481cqw, 57.4689cqh)" />

      {/* Lightbulb */}
      <Shape inset="91.53% 44.46% -5.32% 28.61%" src={f('ec2ea.svg')} rotate="23.57deg" w="hypot(63.5269cqw, 24.9036cqh)" h="hypot(-36.4731cqw, 75.0964cqh)" />
    </>
  );
}

function RightShapes() {
  return (
    <>
      {/* Star */}
      <Shape inset="27.34% -12.23% 61.41% 87.77%" src={f('0141a.svg')} rotate="36.84deg" w="hypot(57.1699cqw, 42.8302cqh)" h="hypot(-42.8301cqw, 57.1698cqh)" />
      {/* Puzzle */}
      <Shape inset="50.11% -13.81% 35.28% 82.05%" src={f('5215b.svg')} rotate="-27.87deg" w="hypot(65.4086cqw, -34.5817cqh)" h="hypot(34.5914cqw, 65.4183cqh)" />
      {/* Briefcase */}
      <Shape inset="75.06% -5.9% 22.34% 96.44%" src={f('46e64.svg')} />
      <Shape inset="75.76% -10.19% 15.45% 87.81%" src={f('03336.svg')} />
      {/* Heads */}
      <Shape inset="92.33% -3.89% -4.13% 75.87%" src={f('a1227.svg')} rotate="-16.49deg" w="hypot(79.9049cqw, -25.8471cqh)" h="hypot(20.0951cqw, 74.1529cqh)" />
      <Shape inset="92.8% -2.93% -3.69% 76.85%" src={f('5ebe1.svg')} rotate="-16.49deg" w="hypot(80.1445cqw, -26.1354cqh)" h="hypot(19.8555cqw, 73.8646cqh)" />
    </>
  );
}

export function DecorBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-cocoon-cream">
      <div className="absolute top-0 left-0 aspect-[402/874] h-full">
        <LeftShapes />
      </div>
      <div className="absolute top-0 right-0 aspect-[402/874] h-full">
        <RightShapes />
      </div>
    </div>
  );
}
