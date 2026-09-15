import type { Tank } from "@/domain/types";
export function readLegacyPrototype(): any | null {
 if(typeof window==="undefined")return null;
 try{return JSON.parse(window.localStorage.getItem("aquaNexus.full.v6")||"null")}catch{return null}
}
/**
 * Full automatic migration will be enabled after schema validation against
 * real user backups. For now legacy JSON can be imported from Settings after
 * exporting a backup from the legacy application.
 */
export function migrateLegacyTank(_legacyTank:unknown):Tank|null{return null}
