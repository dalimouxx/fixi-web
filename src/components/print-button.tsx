'use client';
import {Printer} from 'lucide-react';
export function PrintButton({label='Imprimer le ticket'}:{label?:string}={}){return <button className="btn btn-primary no-print" onClick={()=>window.print()}><Printer/> {label}</button>}
