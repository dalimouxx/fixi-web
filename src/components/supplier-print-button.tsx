'use client';
import {Printer} from 'lucide-react';
export function SupplierPrintButton({label='Imprimer / PDF'}:{label?:string}){return <button className="btn btn-primary" onClick={()=>window.print()}><Printer/> {label}</button>}
