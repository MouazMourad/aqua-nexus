import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest():MetadataRoute.Manifest {
 return {name:"Aqua Nexus 3D",short_name:"Aqua Nexus",description:"Smart Aquarium Management Platform",start_url:"/",display:"standalone",background_color:"#03121c",theme_color:"#03121c",icons:[{src:"/aqua-nexus-icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/aqua-nexus-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/aqua-nexus-icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}]};
}
