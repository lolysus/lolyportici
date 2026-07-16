import { Skeleton } from "@/components/ui/skeleton";
export default function AdminLoading(){return <div className="space-y-6"><Skeleton className="h-11 w-72"/><div className="grid grid-cols-4 gap-px">{Array.from({length:4},(_,index)=><Skeleton key={index} className="h-32"/>)}</div><Skeleton className="h-[420px] w-full"/></div>}
