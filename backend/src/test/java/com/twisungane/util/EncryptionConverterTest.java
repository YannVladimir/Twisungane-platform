package com.twisungane.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * EncryptionConverter is the JPA AttributeConverter that AES-256-GCM-encrypts every PII field
 * (name, nationalId, phone) before it reaches the database. A round-trip test guards the two
 * ways this silently corrupts data: (1) encrypt/decrypt no longer being inverses, and
 * (2) ciphertext reuse — GCM requires a fresh random IV per encryption, so encrypting the same
 * plaintext twice must never produce the same ciphertext.
 */
class EncryptionConverterTest {

    private final EncryptionConverter converter = new EncryptionConverter("test-encryption-key-for-unit-tests-only");

    @Test
    void encryptThenDecryptReturnsTheOriginalValue() {
        String plain = "1199000000000010";
        String encrypted = converter.convertToDatabaseColumn(plain);
        String decrypted = converter.convertToEntityAttribute(encrypted);
        assertEquals(plain, decrypted);
    }

    @Test
    void encryptedValueIsNotTheSameAsThePlaintext() {
        String plain = "Twisungane Admin";
        String encrypted = converter.convertToDatabaseColumn(plain);
        assertNotEquals(plain, encrypted);
    }

    @Test
    void encryptingTheSameValueTwiceProducesDifferentCiphertext() {
        // Each call must use a fresh random IV (AES-GCM requirement) — identical ciphertext for
        // identical plaintext would indicate IV reuse, which breaks GCM's security guarantees.
        String plain = "+250788000000";
        String first = converter.convertToDatabaseColumn(plain);
        String second = converter.convertToDatabaseColumn(plain);
        assertNotEquals(first, second);

        // Both must still decrypt back to the same original value.
        assertEquals(plain, converter.convertToEntityAttribute(first));
        assertEquals(plain, converter.convertToEntityAttribute(second));
    }

    @Test
    void nullAndBlankValuesPassThroughAsNull() {
        assertNull(converter.convertToDatabaseColumn(null));
        assertNull(converter.convertToDatabaseColumn(""));
        assertNull(converter.convertToEntityAttribute(null));
        assertNull(converter.convertToEntityAttribute(""));
    }

    @Test
    void decryptingUnencryptedLegacyDataFallsBackToTheRawValueInsteadOfThrowing() {
        // convertToEntityAttribute() is documented to tolerate pre-encryption legacy rows by
        // returning the raw (unencrypted) string rather than failing. Confirm that contract.
        String legacyPlainValue = "not-actually-encrypted-data";
        assertEquals(legacyPlainValue, converter.convertToEntityAttribute(legacyPlainValue));
    }
}
