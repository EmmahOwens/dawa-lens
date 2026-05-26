pub fn stream_data_mock(size: usize) -> Vec<u8> {
    // Generate some high-throughput data
    vec![0u8; size]
}

pub fn serialize_proto_mock(data: &str) -> Vec<u8> {
    // Mock protobuf serialization
    data.as_bytes().to_vec()
}
