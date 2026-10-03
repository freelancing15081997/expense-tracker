// Design tokens lifted from the Byjan "Graphite & Mint" design (Claude Design artifact).
export type ThemeName = 'dark' | 'light';

export type Palette = {
  bg: string; s1: string; s2: string; tx: string; mu: string;
  ac: string; ai: string; a2: string; po: string; ne: string; wa: string;
  act: string; a2t: string; pot: string; net: string; wat: string;
  pb: string; pf: string; sep: string; ci2: string; sk: string; scrim: string; hdr: string;
  /** book-card gradients */
  c1: string[]; c2: string[]; c3: string[]; c4: string[];
  ct: string; cm: string; fab: string[]; gl: string; glass: string;
  /** flat book (Books list): cover, page leaves */
  bk: string; pg1: string; pg2: string; ci1: string;
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: '#0A0C0F', s1: '#12151A', s2: '#1A1E25', tx: '#F2F5F7', mu: '#8C95A1',
    ac: '#5EE6B5', ai: '#04140E', a2: '#9DB4FF', po: '#5EE6B5', ne: '#FF8A80', wa: '#F5C26B',
    act: 'rgba(94,230,181,0.12)', a2t: 'rgba(157,180,255,0.13)', pot: 'rgba(94,230,181,0.12)',
    net: 'rgba(255,138,128,0.12)', wat: 'rgba(245,194,107,0.13)',
    pb: '#F2F5F7', pf: '#0A0C0F', sep: 'rgba(255,255,255,0.06)', ci2: 'rgba(255,255,255,0.14)',
    sk: 'rgba(255,255,255,0.06)', scrim: 'rgba(5,7,9,0.74)', hdr: 'rgba(10,12,15,0.78)',
    c1: ['#1E2829', '#4F6665', '#22302F', '#3F5554', '#1B2425'],
    c2: ['#1D2240', '#3B4280', '#161A36', '#2A3060'],
    c3: ['#2B2216', '#5E4A2C', '#21190F', '#4A3A22'],
    c4: ['#2E1A24', '#5E3448', '#22121A', '#4A2838'],
    ct: '#F2F5F7', cm: 'rgba(242,245,247,0.68)', fab: ['#C4F9E6', '#5EE6B5', '#2FB989'], gl: 'rgba(94,230,181,0.14)', glass: 'rgba(0,0,0,0.2)', bk: '#1C2027', pg1: '#D9D6CF', pg2: '#A8A49B', ci1: 'rgba(255,255,255,0.3)',
  },
  light: {
    bg: '#F3F5F4', s1: '#FFFFFF', s2: '#EBEFED', tx: '#0B0F12', mu: '#5D6872',
    ac: '#0E9F6E', ai: '#FFFFFF', a2: '#4F63D9', po: '#0B8A5E', ne: '#CF4136', wa: '#A86A12',
    act: 'rgba(14,159,110,0.1)', a2t: 'rgba(79,99,217,0.1)', pot: 'rgba(14,159,110,0.1)',
    net: 'rgba(207,65,54,0.09)', wat: 'rgba(168,106,18,0.1)',
    pb: '#0B0F12', pf: '#FFFFFF', sep: 'rgba(0,0,0,0.07)', ci2: 'rgba(0,0,0,0.07)',
    sk: 'rgba(0,0,0,0.06)', scrim: 'rgba(243,245,244,0.8)', hdr: 'rgba(243,245,244,0.82)',
    c1: ['#D6E2DE', '#FFFFFF', '#D0DDD8', '#EEF3F1'],
    c2: ['#DDE2FA', '#F4F6FF', '#C9D1F5', '#E6EAFC'],
    c3: ['#F3E6D2', '#FFF8EE', '#E6D3B5', '#F3E8D6'],
    c4: ['#F6DCE5', '#FFF3F7', '#ECC6D4', '#F6E0E8'],
    ct: '#0B0F12', cm: 'rgba(11,15,18,0.6)', fab: ['#4FD1A5', '#0E9F6E', '#0A7A55'], gl: 'rgba(14,159,110,0.08)', glass: 'rgba(255,255,255,0.6)', bk: '#FFFFFF', pg1: '#FAF9F6', pg2: '#D8D5CE', ci1: 'rgba(255,255,255,0.9)',
  },
};

export const fonts = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
  bold: 'Satoshi-Bold',
  black: 'Satoshi-Black',
  mono: 'JetBrainsMono_500Medium',
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };
export const space = { gutter: 20 };

/** Avatar colours per person, from the design. */
export const avatarColors: Record<string, [string, string]> = {
  AK: ['#FFE1D1', '#6B2A0B'], PS: ['#E8E0FF', '#2A1F55'], RV: ['#D5F5E3', '#0E4A2E'],
  KS: ['#FFE9B8', '#5A3E00'], MI: ['#DCEBFF', '#14366B'], NR: ['#FFE9B8', '#5A3E00'],
};

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const inrSigned = (n: number) => (n < 0 ? '−' : '+') + inr(Math.abs(n));
