DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id`   INT UNSIGNED AUTO_INCREMENT NOT NULL,
  `type` ENUM('stream','file','playlist') NOT NULL,
  `name` TEXT CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `path` VARCHAR(512) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL UNIQUE,
  `description` TEXT CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `country` CHAR(2) DEFAULT NULL,
  
  PRIMARY KEY (`id`)
);

INSERT INTO `ass`.`items` (`id`, `type`, `name`, `path`, `description`, `country`) VALUES (NULL, 'stream', 'Nowy Świat', 'https://de1.api.radio-browser.info/pls/url/429ed05b-6dae-4027-a9be-7fda436a89fe', 'AAC', 'pl');
INSERT INTO `ass`.`items` (`id`, `type`, `name`, `path`, `description`, `country`) VALUES (NULL, 'stream', 'Nowy Świat', 'https://n04a-eu.rcs.revma.com/ypqt40u0x1zuv', NULL, 'pl');
INSERT INTO `ass`.`items` (`id`, `type`, `name`, `path`, `description`, `country`) VALUES (NULL, 'stream', 'France Info', 'https://de1.api.radio-browser.info/pls/url/aa555e8a-08d9-11e8-ae97-52543be04c81', NULL, 'fr');
