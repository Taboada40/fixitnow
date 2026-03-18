package com.fixitnow.fixitnow_backend.service;

import com.fixitnow.fixitnow_backend.model.NotificationItem;
import com.fixitnow.fixitnow_backend.model.ReportItem;
import com.fixitnow.fixitnow_backend.repository.SupabaseNotificationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final SupabaseNotificationRepository notificationRepository;

    public NotificationService(SupabaseNotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public void notifyAdminNewReport(ReportItem report) {
        NotificationItem item = new NotificationItem();
        item.setReportId(report.getId());
        item.setRecipientRole("ADMIN");
        item.setTitle("New report received");
        item.setMessage(report.getTitle() + " at " + report.getLocation());
        item.setIsRead(false);
        notificationRepository.insert(item);
    }

    public void notifyUserStatusUpdate(ReportItem report) {
        NotificationItem item = new NotificationItem();
        item.setReportId(report.getId());
        item.setRecipientRole("USER");
        item.setRecipientUserId(report.getUserId());
        item.setRecipientEmail(report.getEmail());
        item.setTitle("Report status updated");
        item.setMessage("Your report is now " + report.getStatus());
        item.setIsRead(false);
        notificationRepository.insert(item);
    }

    public List<NotificationItem> listUserNotifications(Long userId, String email) {
        return notificationRepository.listForUser(userId, email);
    }

    public List<NotificationItem> listAdminNotifications() {
        return notificationRepository.listForAdmin();
    }
}
