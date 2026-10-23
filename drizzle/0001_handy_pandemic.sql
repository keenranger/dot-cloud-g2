CREATE INDEX `relay_timeline_idx` ON `relay_records` (`owner`,`kind`,json_extract(`value`, '$.createdAt'));--> statement-breakpoint
CREATE INDEX `relay_pending_idx` ON `relay_records` (`owner`,json_extract(`value`, '$.createdAt')) WHERE `kind` = 'utterance' AND json_extract(`value`, '$.status') != 'replied';
