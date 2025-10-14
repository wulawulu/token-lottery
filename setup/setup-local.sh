solana account -um --output json-compact 3DNK48NH6jvay2nHBiW3wk5yWegD9C2crk2vd9aznRz6 > oracle7.json
solana account -um --output json-compact 7EyXLrFUtoRoYKhPBnRpjyo2nGTsfGgo2d7XcPb4TwPF > oracle6.json
solana account -um --output json-compact 2RN1v42zWzzKhLty3Dgen1vbRc4eBsE8PCHanvaSLwJc > oracle5.json
solana account -um --output json-compact CXyurDdbo9JR5Xh9QuknMJSsuGM3aQdsa38ZVrKSjp1c > oracle4.json
solana account -um --output json-compact GLc9EQ5ARgnBJvM59wU6eNjaeAEeBa1Gj7jp8rT5NJ8v > oracle3.json
solana account -um --output json-compact 8Vjo4QEbmB9QhhBu6QiTy66G1tw8WomtFVWECMi3a71y > oracle2.json
solana account -um --output json-compact BuZBFufhjGn1HDUCukJYognbeoQQW8ACZJq5sWoQPnGe > oracle1.json
solana account -um --output json-compact GcNZRMqGSEyEULZnLDD3ParcHTgFBrNfUdUCDtThP55e > oracle0.json
solana account -um --output json-compact A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w > randomness_queue.json
solana account -um --output json-compact 7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa > sb_randomness_config.json
solana program dump -u m SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv ondemand.so
solana program dump -u m SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f switchboard.so
solana program dump -u m metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
anchor idl fetch --provider.cluster mainnet SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv  > switchboard_on_demand_idl.json