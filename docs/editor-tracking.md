# 記事管理と作品リスト

追跡状態は既存の `game_following` を正本とし、通常は is_managed=true, is_favorite=false、★お気に入りは両方true、追跡対象外は両方false。既存の remove/restore を利用。公開記事と発売情報は残す。重要な通常ニュースは例外として収集できる。記事の非掲載と追跡対象外の同時保存は関連作品・処理完了をDBで検証し、同一トランザクションで行う。

```sql
create function public.reject_article_with_tracking(p_article_id bigint,p_game_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_article_id is null or p_article_id<=0 or p_game_id is null then raise exception 'Invalid request' using errcode='22023'; end if;
 perform 1 from public.articles where id=p_article_id and processing_status='completed' for update;
 if not found then return false; end if;
 perform 1 from public.article_games where article_id=p_article_id and game_id=p_game_id for update;
 if not found then return false; end if;
 update public.articles set status='rejected',manually_reviewed=true,updated_at=now() where id=p_article_id;
 perform public.set_game_following(p_game_id,'remove');
 return true;
end $$;
revoke all on function public.reject_article_with_tracking(bigint,uuid) from public,anon,authenticated;
grant execute on function public.reject_article_with_tracking(bigint,uuid) to service_role;
```
