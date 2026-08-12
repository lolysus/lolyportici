import Image from "next/image";
import { Reveal } from "@/components/site/reveal";
import { TiltCard } from "@/components/site/tilt-card";
import { sitePhotos, type SitePhotoName } from "@/lib/site-photos";

interface Dish {
  photo: SitePhotoName;
  name: string;
  kind: string;
  description: string;
}

/**
 * Le specialità mostrate in vetrina. I nomi e le descrizioni sono pensati per
 * far venire fame senza promettere ingredienti che non ci sono: descrivono ciò
 * che si vede nel piatto. Modificabili qui in un posto solo.
 */
const dishes: Dish[] = [
  { photo: "bao-katsu", name: "Bao Katsu", kind: "Bao · Signature", description: "Panino bao cotto al vapore, cotoletta croccante in panko, teriyaki e insalata fresca." },
  { photo: "har-gow", name: "Har Gow", kind: "Dim Sum · Vapore", description: "Ravioli di gambero al vapore, avvolti in un velo di pasta di riso traslucida." },
  { photo: "udon", name: "Udon Saltati", kind: "Wok · Caldo", description: "Udon spadellati al wok con gambero, verdure croccanti e uovo." },
  { photo: "taco", name: "Taco Fusion", kind: "Fusion · Croccante", description: "Cialda croccante, ripieno fusion, mandorle tostate e carote marinate." },
  { photo: "dolce-fritto", name: "Sushi Dolce", kind: "Dessert · Fritto caldo", description: "Roll caldo e croccante, panna montata, frutta fresca e salsa al cioccolato." },
];

export function DishGallery() {
  return (
    <div className="perspective-stage-lg mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {dishes.map((dish, i) => {
        const photo = sitePhotos[dish.photo];
        // La prima specialità occupa più spazio su desktop: fa da protagonista.
        const feature = i === 0;
        return (
          <Reveal
            key={dish.photo}
            as="article"
            delay={i * 90}
            className={feature ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : ""}
          >
            <TiltCard className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-card">
              <div className={`relative overflow-hidden ${feature ? "aspect-[4/5] h-full lg:aspect-auto" : "aspect-[4/5]"}`}>
                <Image
                  src={photo.src}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  placeholder="blur"
                  blurDataURL={photo.blurDataURL}
                  className="dish-media object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{dish.kind}</p>
                  <h3 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">{dish.name}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">{dish.description}</p>
                </div>
              </div>
            </TiltCard>
          </Reveal>
        );
      })}
    </div>
  );
}
