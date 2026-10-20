import type {SVGProps} from 'react';

/**
 * Fixi mark: geometric F built from a repair-ready circuit path.
 * CSS-based brand colors; no font file, external asset or raster dependency.
 */
export function FixiMark({compact=false,className='',...props}:{compact?:boolean;className?:string}&SVGProps<SVGSVGElement>){
  return <span className={'fixi-mark'+(compact?' compact':'')+(className?' '+className:'')}>
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 38" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 30V9.5a2 2 0 0 1 2-2h15" strokeWidth="5.2"/>
      <path d="M11 18.5h13.2" strokeWidth="5.2"/>
      <path d="m23 29.5 6.5-6.5m0 6.5L23 23" strokeWidth="3.8"/>
    </svg>
  </span>;
}
