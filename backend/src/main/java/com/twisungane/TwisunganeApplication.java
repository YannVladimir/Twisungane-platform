package com.twisungane;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TwisunganeApplication {

    public static void main(String[] args) {
        SpringApplication.run(TwisunganeApplication.class, args);
    }
}
