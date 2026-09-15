import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest():MetadataRoute.Manifest {
 return {name:"Aqua Nexus 3D",short_name:"Aqua Nexus",description:"Smart Aquarium Management Platform",start_url:"/",display:"standalone",background_color:"#03121c",theme_color:"#03121c",icons:[]};
}
