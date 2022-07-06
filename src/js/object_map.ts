import * as cyfs from '../cyfs_sdk/cyfs'

class ObjectMapBase {
    protected m_path: string;
    protected m_op: cyfs.PathOpEnvStub;
    public constructor(op: cyfs.PathOpEnvStub, path: string) {
        this.m_op = op;
        this.m_path = path;
    }

    public async commit(): Promise<cyfs.BuckyResult<cyfs.DecRootInfo>> {
        return await this.m_op.commit();
    }
    public async abort(): Promise<cyfs.BuckyResult<void>> {
        return (await this.m_op.abort()).map((v) => undefined);
    }

    public async delete(key: string): Promise<cyfs.BuckyResult<cyfs.ObjectId | undefined>> {
        return await this.m_op.remove_with_key(this.m_path, key);
    }
}

class ObjectMap extends ObjectMapBase {
    public async get(key: string): Promise<cyfs.BuckyResult<cyfs.ObjectId | undefined>> {
        return await this.m_op.get_by_key(this.m_path, key);
    }
    public async set(
        key: string,
        value: cyfs.ObjectId,
        isAutoInsert: boolean,
        pre?: cyfs.ObjectId
    ): Promise<cyfs.BuckyResult<cyfs.ObjectId | undefined>> {
        if (pre) {
            return await this.m_op.set_with_key(this.m_path, key, value, pre, isAutoInsert);
        } else {
            return (await this.m_op.insert_with_key(this.m_path, key, value)).map((_) => undefined);
        }
    }
}

class ObjectSet extends ObjectMapBase {
    public async add(value: cyfs.ObjectId): Promise<cyfs.BuckyResult<boolean>> {
        return await this.m_op.insert(this.m_path, value);
    }

    public async contains(value: cyfs.ObjectId): Promise<cyfs.BuckyResult<boolean>> {
        return await this.m_op.contains(this.m_path, value);
    }
}

async function initPathOpByPath(
    path: string,
    stack: cyfs.SharedObjectStack
): Promise<cyfs.BuckyResult<cyfs.PathOpEnvStub>> {
    const cr = await stack.root_state_stub().create_path_op_env();
    if (cr.err) {
        console.error(`load object(path=${path}) failed when create path_op, ${cr}.`);
        return cr;
    }

    return cyfs.Ok(cr.unwrap());
}

export async function initObjectMapByPath(
    path: string,
    stack: cyfs.SharedObjectStack
): Promise<cyfs.BuckyResult<ObjectMap>> {
    const ir = await initPathOpByPath(path, stack);
    if (ir.err) {
        return ir;
    }
    return cyfs.Ok(new ObjectMap(ir.unwrap(), path));
}

export function initObjectMapByPathOpEnv(path: string, opEnv: cyfs.PathOpEnvStub): ObjectMap {
    return new ObjectMap(opEnv, path);
}

export async function initObjectSetByPath(
    path: string,
    stack: cyfs.SharedObjectStack
): Promise<cyfs.BuckyResult<ObjectSet>> {
    const ir = await initPathOpByPath(path, stack);
    if (ir.err) {
        return ir;
    }
    return cyfs.Ok(new ObjectSet(ir.unwrap(), path));
}

export function initObjectSetByPathOpEnv(path: string, opEnv: cyfs.PathOpEnvStub): ObjectSet {
    return new ObjectSet(opEnv, path);
}

async function forEach(
    path: string,
    proc: (value: cyfs.ObjectId, key?: string) => boolean,
    options: {
        stack: cyfs.SharedObjectStack;
        step?: number; // default: 10
    }
): Promise<cyfs.BuckyResult<void>> {
    const cr = await options.stack.root_state_stub().create_single_op_env();
    if (cr.err) {
        console.error(`foreach object(path=${path}) failed when create single_op, ${cr}.`);
        return cr;
    }
    const singleOpEnv = cr.unwrap();
    const lr = await singleOpEnv.load_by_path(path);
    if (lr.err) {
        if (lr.val.value === cyfs.BuckyErrorCode.NotFound) {
            console.warn(`foreach object(path=${path}) not found.`);
        } else {
            console.error(`foreach object(path=${path}) failed when load single_op, ${lr}.`);
            singleOpEnv.abort();
            return lr;
        }
    } else {
        // 遍历
        const step = options.step || 10;
        let isAbort = false;
        let loadLast: Array<cyfs.ObjectMapContentItem> = [];
        let itWaiter = singleOpEnv.next(step);
        do {
            for (const item of loadLast) {
                isAbort = proc((item.map || item.set)!.value, item.map?.key);
                if (isAbort) {
                    break;
                }
            }

            const loadR = await itWaiter;
            if (loadR.err) {
                const msg = `load (${path}) interator failed, ${loadR}.`;
                console.error(msg);
                singleOpEnv.abort();
                return loadR;
            }
            loadLast = loadR.unwrap();
            if (loadLast.length > 0) {
                itWaiter = singleOpEnv.next(step);
            } else {
                break;
            }
        } while (!isAbort);
    }

    singleOpEnv.abort();
    return cyfs.Ok(undefined);
}

export async function objectMapForEach(
    path: string,
    proc: (value: cyfs.ObjectId, key: string) => boolean,
    options: {
        stack: cyfs.SharedObjectStack;
        step?: number; // default: 10
    }
) {
    return await forEach(path, (value, key) => proc(value, key!), options);
}

export async function objectSetForEach(
    path: string,
    proc: (value: cyfs.ObjectId) => boolean,
    options: {
        stack: cyfs.SharedObjectStack;
        step?: number; // default: 10
    }
) {
    return await forEach(path, (value, key) => proc(value), options);
}