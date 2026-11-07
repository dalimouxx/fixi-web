import type {Metadata} from 'next';
import {FixiOnePreview} from '@/components/fixi-one/preview';

export const metadata:Metadata={
  title:'FIXI One — Prototype UX',
  description:'Démonstration interactive isolée de FIXI Supplier, Atelier et Livreur, sans données réelles.',
  robots:{index:false,follow:false},
};

export default function FixiOneDesignPreview(){
  return <FixiOnePreview/>;
}
