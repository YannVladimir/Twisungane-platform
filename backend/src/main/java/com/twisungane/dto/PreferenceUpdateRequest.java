package com.twisungane.dto;

import lombok.Data;

@Data
public class PreferenceUpdateRequest {
    private String language;
    private String theme;
}
