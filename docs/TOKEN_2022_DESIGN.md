# Token-2022 NonTransferable Mint Design

Shared Token-2022 architecture for RLAN and ICELAN non-transferable credentials.

## Overview

RLAN engagement marks and ICELAN reward credentials are non-transferable by design. Token-2022's `NonTransferable` extension provides the mint-level enforcement layer.

**Scope:** This document specifies the token mint parameters. Program implementation is ansem-radio scope.

## Mint Configuration

```rust
Mint {
    mint_authority: Some(authority),
    supply: 0,
    decimals: 0,  // credentials are discrete units
    
    // Extensions
    extensions: {
        NonTransferable,        // Disallow transfers
        MetadataPointer {       // Link to metadata PDA
            authority: Some(metadata_authority),
            metadata_address: metadata_pda
        },
        MintCloseAuthority {    // Allow closing mint if supply=0
            close_authority: Some(authority)
        }
    }
}
```

## Constraints

1. **Supply per credential:** Each RLAN engagement or ICELAN credential mints exactly 1 token to the creator's ATA
2. **Burn not allowed:** NonTransferable extension prevents all transfers, including burns
3. **Metadata:** Mint metadata stored in associated MetadataPointer PDA
4. **Closure:** Mint can be closed after all tokens are revoked (future scope)

## Rationale

- **NonTransferable:** Prevents reassignment, ensures 1:1 binding to creator
- **Zero decimals:** Credentials are discrete, not fractional
- **Metadata via MetadataPointer:** Decouples token metadata from program data
- **MintCloseAuthority:** Future cleanup capability

## References

- [Token-2022 NonTransferable Extension](https://solana.com/docs/token/token-2022/extensions)
- PDA layouts: `docs/ONCHAIN_DESIGN.md`
- RLAN adapter: `src/rlan.js`
- ICELAN adapter: `src/icelan.js`
