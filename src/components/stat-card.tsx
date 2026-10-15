import { ReactNode } from 'react';
export function StatCard({label,value,note,icon}:{label:string;value:ReactNode;note?:string;icon?:ReactNode}){return <div className="card stat-card">{icon&&<div className="stat-icon">{icon}</div>}<div className="stat-label">{label}</div><div className="stat-value">{value}</div>{note&&<div className="stat-note">{note}</div>}</div>}
