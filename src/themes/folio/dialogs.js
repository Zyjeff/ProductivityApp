import {useEffect} from 'react';

// Contain keyboard focus without changing any app shortcuts.
export function useDialogFocus(ui){
  const selector=ui.paletteOpen?'.w-slab':ui.launchNoteFor?'.f-publication':ui.focusTaskId?'.w-focus-overlay':ui.reviewWeek?'.f-review':ui.helpOpen?'.f-help-sheet':ui.formOpen?'.f-manuscript':ui.endOfDayOpen?'.f-final-proof':null;
  useEffect(()=>{
    if(!selector)return;
    const dialog=document.querySelector(selector);
    if(!dialog)return;
    const previous=document.activeElement;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const targets=()=>[...dialog.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const timer=setTimeout(()=>{if(!dialog.contains(document.activeElement))targets()[0]?.focus();},0);
    const onTab=e=>{
      if(e.key!=='Tab')return;
      const elements=targets();
      const first=elements[0],last=elements.at(-1);
      if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',onTab);
    return()=>{clearTimeout(timer);document.removeEventListener('keydown',onTab);document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[selector]);
}
