"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function AdminError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><AlertTriangle className="mb-5 size-10 text-destructive"/><h1 className="font-heading text-3xl">La regia ha perso il collegamento</h1><p className="mt-3 max-w-md text-sm text-muted-foreground">I dati non sono stati modificati. Controlla la connessione e riprova.</p><Button className="mt-7" onClick={reset}><RotateCcw/>Riprova</Button></div>}
