import * as cyfs from '../cyfs_sdk/cyfs'

interface ToBase58 {
    to_base_58: () => string;
}

export function objectIdToStr(id: ToBase58 | string): string {
    if (typeof id === 'string') {
        return id;
    } else {
        return id.to_base_58();
    }
}


export function targetFromUrl(url: string) {
	// return WIKI_DAO_TARGET;
	try {
		const [schma, _, hostOrT, target] = url.split("/");
		if ((schma === "cyfs:" && hostOrT === "o") || hostOrT === "r") {
			const decodeR = cyfs.PeopleId.from_base_58(target);
			if (decodeR.ok) {
				return decodeR.unwrap().object_id;
			}
		}
	} catch {}
	return undefined;
}

export function makeOLink(
	ownerId: cyfs.ObjectId | cyfs.PeopleId | string,
	objId: cyfs.ObjectId | string
): string {
	return `cyfs://o/${objectIdToStr(ownerId)}/${objectIdToStr(objId)}`;
}

export function makeRLink(
	ownerId: cyfs.ObjectId | cyfs.PeopleId | string,
	path: string
) {
	return [`cyfs://r`, objectIdToStr(ownerId), path].join("/");
}