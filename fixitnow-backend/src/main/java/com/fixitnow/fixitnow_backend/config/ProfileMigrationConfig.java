package com.fixitnow.fixitnow_backend.config;

import java.util.logging.Level;
import java.util.logging.Logger;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.fixitnow.fixitnow_backend.repository.SupabaseProfileRepository;

@Component
public class ProfileMigrationConfig {

    private static final Logger LOGGER = Logger.getLogger(ProfileMigrationConfig.class.getName());

    private final SupabaseProfileRepository profileRepository;

    public ProfileMigrationConfig(SupabaseProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrateLegacyProfiles() {
        try {
            int migrated = profileRepository.migrateLegacyProfiles();
            if (migrated > 0) {
                LOGGER.log(Level.INFO, "Migrated {0} legacy profile row(s) from profiles to user_profiles.", migrated);
            }
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "Legacy profile migration skipped: {0}", ex.getMessage());
            LOGGER.log(Level.FINE, "Legacy profile migration stack trace", ex);
        }
    }
}
