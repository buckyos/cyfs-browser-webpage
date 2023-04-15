import {
    BuckyError,
    BuckyResult, DecApp,
    error,
    NDNAPILevel,
    NONAPILevel,
    NONObjectInfo,
    ObjectId,
    SharedCyfsStack, TransTaskRequest,
    TransTaskState,
    Ok
} from '../../cyfs_sdk/cyfs';
import {JSONObject, JSONObjectDecoder} from "./json_object";

export type ShareType = "fixed" | "latest";

export interface ShareRecord {
    name: string;
    path: string;
    id: string;
    url: string;
    size: number;
    file_type: string;
    modify_time: number;
    is_share: boolean;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
}

export interface DirItem {
    id: string;
    name: string;
    modify_time: number;
    is_share: boolean;
    file_type: string;
    size: number;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
}

export interface HistoryRecord {
    id: string;
    modify_time: number;
    size: number;
    history_type: string;
}

export interface PathDetail {
    id: string;
    size: number;
    file_type: string;
    create_time: number;
    modify_time: number;
    is_share: boolean;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
    owner_id?: string;
    owner_name?: string;
    owner_icon?: string;
    share_type?: ShareType;
    password?: string;
    share_time?: number;
    effective_time?: number;
}

export interface SharePathDetail {
    id: string;
    size: number;
    file_type: string;
    create_time: number;
    modify_time: number;
    is_secret: boolean;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
    owner_id?: string;
    owner_name?: string;
    owner_icon?: string;
    share_type?: ShareType;
}

export interface ShareReq {
    path: string;
    effect_time?: number;
    password?: string;
    share_type?: ShareType;
}

export interface UpdateShareReq {
    share_name: string;
    effect_time?: number;
    password?: string;
}

export interface ServerStatus {
    total_space: number;
    available_space: number;
}

export interface DSGStatus {
    total_space: number;
    available_space: number;
    used_space: number;
    launch_status: number;
    account_id: string;
    is_sync: number;
}

export interface DeleteRecord {
    id: string;
    path: string;
    delete_time: number;
    size: number;
}

export interface GetDeleteListResp {
    sum: number;
    list: DeleteRecord[];
}

export interface ModifyHistory {
    id: string;
    path: string;
    modify_time: string;
    size: number;
    is_share: boolean;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
}

export interface SearchRecord {
    id: string;
    path: string;
    file_type: string;
    size: number;
    modify_time: number;
    is_share: boolean;
    ipfs_cid?: string;
    share_path?: string;
    thumbnail_id?: string;
}

export interface UploadFile {
    path: string;
    object_id: string;
}

export interface Favorite {
    target: string;
    dec_id: string;
    path: string;
}

export interface DownloadShareTaskStatus {
    task_status: "stopped" | "downloading" | "finished" | "failed";
    download_speed?: number;
    percent?: number;
    downloading_file?: string;
}

export type UploadTaskStatus = "Stopped" | {"Syncing":[string[], string[]]} | {"Finished": string[]} | {"Failed": string}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class FoggieDrive {
    stack: SharedCyfsStack;
    dec_id: ObjectId;

    constructor(stack: SharedCyfsStack) {
        this.stack = stack;
        this.dec_id = DecApp.generate_id(ObjectId.from_str("5r4MYfFPKMeHa1fec7dHKmBfowySBfVFvRQvKB956dnF").unwrap(), "Foggie Drive");
    }

    drive_dec_id(): ObjectId {
        return this.dec_id;
    }

    private async request(obj_type: number, req_data?: any, req_path?: string, target?: ObjectId): Promise<BuckyResult<any>> {
        if (!req_path) {
            req_path = "commands";
        }
        const ret = await this.stack.util().get_device({common: {flags: 0}});
        if (ret.err) {
            error("request err", ret, " obj_type ", obj_type);
            return ret;
        }
        const {device_id} = ret.unwrap();

        let send_content;
        if (req_data) {
            const encoder = new TextEncoder();
            send_content = encoder.encode(JSON.stringify(req_data));
        } else {
            send_content = new Uint8Array();
        }
        const obj = JSONObject.create(this.dec_id, device_id.object_id, obj_type, send_content);
        const obj_id = obj.desc().calculate_id();
        const obj_data = new Uint8Array(obj.raw_measure().unwrap());
        obj.raw_encode(obj_data).unwrap();
        const result = await this.stack.non_service().post_object({
            "common": {
                "req_path": req_path,
                "dec_id": this.dec_id,
                "level": NONAPILevel.Router,
                "flags": 0,
                "target": target,
            }, "object": new NONObjectInfo(obj_id, obj_data)
        });
        if (result.err) {
            error("request err", result, " obj_type ", obj_type);
            return result;
        }

        const ret_obj = new JSONObjectDecoder().raw_decode(result.unwrap().object!!.object_raw);
        if (ret_obj.err) {
            error("request err", ret_obj, " obj_type ", obj_type);
            return result;
        }

        const [ret_json_obj] = ret_obj.unwrap();
        const decoder = new TextDecoder();
        const data = decoder.decode(ret_json_obj.body()!.content().data);
        const json_obj = JSON.parse(data);

        return Ok(json_obj);
    }

    async get_dsg_status(): Promise<BuckyResult<DSGStatus>> {
        return await this.request(5);
    }

    async get_status(): Promise<BuckyResult<ServerStatus>> {
        return await this.request(20);
    }

    async share(path: string): Promise<BuckyResult<ShareRecord>> {
        return await this.request(22, path);
    }

    async unshare(path: string, object_id: string): Promise<BuckyResult<string>> {
        return await this.request(24, {path, object_id});
    }

    async get_shares(): Promise<BuckyResult<[ShareRecord]>> {
        return await this.request(26, null);
    }

    async list_dir(path: string): Promise<BuckyResult<[DirItem]>> {
        return await this.request(28, path);
    }

    async get_file_history(path: string): Promise<BuckyResult<[HistoryRecord]>> {
        return await this.request(30, path);
    }

    async get_path_detail(path: string): Promise<BuckyResult<PathDetail>> {
        return await this.request(32, path);
    }

    async restore_file(path: string, object_id: string): Promise<BuckyResult<any>> {
        return await this.request(34, {path, object_id});
    }

    async get_recycle_list(offset: number, length: number): Promise<BuckyResult<GetDeleteListResp>> {
        return await this.request(38, {offset, length});
    }

    async remove_recycle_item(id: string): Promise<BuckyResult<string>> {
        return await this.request(40, id);
    }

    async clear_recycle(): Promise<BuckyResult<string>> {
        return await this.request(44, null);
    }

    async recovery_from_recycle(id: string): Promise<BuckyResult<string>> {
        return await this.request(42, id);
    }

    async get_modify_history_list(): Promise<BuckyResult<ModifyHistory[]>> {
        return await this.request(46);
    }

    async new_dir(path: string): Promise<BuckyResult<string>> {
        return await this.request(48, path);
    }

    async rename(src_path: string, dest_path: string): Promise<BuckyResult<string>> {
        return await this.request(50, {src_path, dest_path});
    }

    async delete(path: string): Promise<BuckyResult<string>> {
        return await this.request(52, path);
    }

    async copy(src_path: string, dest_path: string): Promise<BuckyResult<string>> {
        return await this.request(54, {src_path, dest_path});
    }

    async move(src_path: string, dest_path: string): Promise<BuckyResult<string>> {
        return await this.request(56, {src_path, dest_path});
    }

    async search(name: string): Promise<BuckyResult<SearchRecord[]>> {
        return await this.request(58, name);
    }

    async upload_file(path: string, object_id: string): Promise<BuckyResult<string>> {
        return await this.request(60, {path, object_id});
    }

    async get_upload_state(task_id: string): Promise<BuckyResult<UploadTaskStatus>> {
        return await this.request(66, task_id);
    }

    async get_stored_data_size(): Promise<BuckyResult<string>> {
        return await this.request(68);
    }

    async pin_from_ipfs(name: string, cid: string): Promise<BuckyResult<any>> {
        return await this.request(70, {name, cid});
    }

    async attach_files(files: UploadFile[]): Promise<BuckyResult<any>> {
        return await this.request(72, files);
    }

    async share2(path: string, effect_time?: number, password?: string, share_type?: ShareType): Promise<BuckyResult<ShareRecord>> {
        return await this.request(80, {path, effect_time, password, share_type});
    }

    async update_share(share_name: string, effect_time?: number, password?: string): Promise<BuckyResult<any>> {
        return await this.request(82, {share_name, effect_time, password});
    }

    async check_share_auth(target: ObjectId, path: string): Promise<BuckyResult<"public" | "secret">> {
        return await this.request(74, path, "pub_commands", target);
    }

    async verify_share_password(target: ObjectId, path: string, password: string): Promise<BuckyResult<"success" | "error">> {
        return await this.request(76, {path, password}, "pub_commands", target);
    }

    async get_share_detail_info(target: ObjectId, path: string): Promise<BuckyResult<SharePathDetail>> {
        return await this.request(78, path, "pub_commands", target);
    }

    async add_favorite(target: string, dec_id: string, path: string): Promise<BuckyResult<any>> {
        return await this.request(84, {target, dec_id, path});
    }

    async get_favorites(): Promise<BuckyResult<Favorite[]>> {
        return await this.request(86);
    }

    async remove_favorite(target: string, dec_id: string, path: string): Promise<BuckyResult<any>> {
        return await this.request(88, {target, dec_id, path});
    }

    async download_share(target: string, dec_id: string, path: string, save_path: string): Promise<BuckyResult<string>> {
        return await this.request(90, {target, dec_id, path, save_path});
    }

    async get_download_share_status(task_id: string): Promise<BuckyResult<DownloadShareTaskStatus>> {
        return await this.request(92, task_id);
    }
}
