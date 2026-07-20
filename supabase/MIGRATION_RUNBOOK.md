# Migrazione Supabase Loly

Questa procedura applica lo schema Loly al progetto Supabase corretto, senza
toccare Montallegro. La migrazione `0010_tenant_integrity_and_workflow_guards`
rafforza l'isolamento tra YUKO e KouSushi e non elimina dati esistenti.

## Prima della migrazione

1. Verificare nel dashboard Supabase il progetto di destinazione e creare un backup.
2. Collegare esclusivamente il progetto Loly:

   ```powershell
   npx supabase link --project-ref <PROJECT_REF_LOLY>
   npx supabase migration list --linked
   ```

3. Controllare l'elenco delle sole migrazioni da applicare:

   ```powershell
   npx supabase db push --linked --dry-run
   ```

## Applicazione e controllo

```powershell
npx supabase db push --linked
```

Dopo il push, verificare una prenotazione per ciascuna sede, una modifica
cliente, una richiesta in lista d'attesa e una notifica nella dashboard. Il
seed (`--include-seed`) va usato solo su ambienti demo/sandbox, mai sulla
produzione con dati reali.
