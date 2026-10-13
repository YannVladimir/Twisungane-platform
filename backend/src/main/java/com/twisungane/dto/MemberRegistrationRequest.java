package com.twisungane.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class MemberRegistrationRequest {
    @NotBlank(message = "National ID is required")
    @Size(min = 16, max = 16, message = "National ID must be exactly 16 characters")
    private String nationalId;

    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    private String email;

    @NotBlank(message = "Phone number is required")
    private String phone;

    @NotBlank(message = "Password is required")
    private String password;

    private UUID guarantorId;
    private LocalDate joinDate;
    private LocalDate dateOfBirth;

    @NotNull(message = "Initial shares is required")
    @DecimalMin(value = "0.0", message = "Initial shares cannot be negative")
    private Double initialShares;

    private String transactionReference;
    private String role;
}
