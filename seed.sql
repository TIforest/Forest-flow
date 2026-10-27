INSERT OR IGNORE INTO users (id,name,role,job) VALUES
('coord','Coordenador TI','coordinator','Coordenação de TI'),
('bruno','Bruno','member','Tecnologia da Informação'),
('ana','Ana · exemplo','member','Infraestrutura'),
('lucas','Lucas · exemplo','member','Sistemas');
INSERT OR IGNORE INTO tasks (id,title,description,assignee_id,created_by,week,due_date,priority,status,block_reason) VALUES
('demo-1','Revisar permissões das pastas compartilhadas','Validar os acessos com os responsáveis de cada setor.','bruno','coord','2026-10-25','2026-10-30','high','progress',''),
('demo-2','Validar rotina de backup','Conferir os registros e executar um teste de restauração.','ana','coord','2026-10-25','2026-10-28','normal','progress',''),
('demo-3','Acompanhar atualização do ERP','Aguardar a confirmação da janela de manutenção pelo fornecedor.','lucas','coord','2026-10-25','2026-10-29','high','blocked','Aguardando confirmação do fornecedor'),
('demo-4','Inventariar equipamentos de TI','Atualização do inventário concluída.','bruno','coord','2026-10-25','2026-10-27','normal','done',''),
('demo-5','Revisar alertas de monitoramento','Ajustes realizados nos alertas de infraestrutura.','ana','coord','2026-10-18','2026-10-23','normal','done','');
INSERT OR IGNORE INTO task_weeks(task_id,week,added_by) SELECT id,week,created_by FROM tasks;



