DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id`   INT UNSIGNED AUTO_INCREMENT NOT NULL,
  `type` ENUM('stream','file','playlist') NOT NULL,
  `name` TEXT CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `path` TEXT CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  
  PRIMARY KEY (`id`)
);

INSERT INTO `test`.`items` (`id`, `type`, `name`, `path`) VALUES (NULL, 'stream', 'nowy swiat', 'https://n04a-eu.rcs.revma.com/ypqt40u0x1zuv')
