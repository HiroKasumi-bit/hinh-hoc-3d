import { useEffect, useState } from 'react';

export interface ViewportProfile {
  width: number;
  height: number;
  /** True on phones in BOTH portrait & landscape (width < 900 or height < 540) */
  isCompact: boolean;
  /** True specifically when phone is held horizontally (short height, wide width) */
  isPhoneLandscape: boolean;
  /** True specifically when phone is held vertically */
  isPhonePortrait: boolean;
}

function readViewport(): ViewportProfile {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800, isCompact: false, isPhoneLandscape: false, isPhonePortrait: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPhoneLandscape = height < 540 && width > height;
  const isPhonePortrait = width < 640 && height >= width;
  const isCompact = width < 960 || height < 540;
  return { width, height, isCompact, isPhoneLandscape, isPhonePortrait };
}

export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(readViewport);

  useEffect(() => {
    const update = () => setProfile(readViewport());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return profile;
}
