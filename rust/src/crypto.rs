use sha2::{Sha256, Digest};

pub fn hash_data(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

pub fn compute_audit_hash(prev_hash: &str, payload: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(b":");
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}
