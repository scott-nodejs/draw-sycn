package com.whiteboard.server.paperprocessing;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import javax.imageio.ImageIO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class PageImagePreprocessor {
  private final JdbcTemplate jdbc;
  public PageImagePreprocessor(JdbcTemplate jdbc){this.jdbc=jdbc;}

  public Summary process(String paperId,Path paperDirectory)throws Exception{
    List<Page> pages=jdbc.query("SELECT page_number,normalized_object_key FROM paper_page WHERE paper_id=? ORDER BY page_number",(rs,n)->new Page(rs.getInt(1),Paths.get(rs.getString(2))),paperId);
    int repaired=0,totalScore=0;Path output=paperDirectory.resolve("preprocessed");Files.createDirectories(output);
    for(Page page:pages){BufferedImage source=ImageIO.read(page.path.toFile());if(source==null)continue;Metrics metrics=measure(source);int score=score(source,metrics);Path selected=page.path;String status="quality_checked";
      if(score<65){BufferedImage enhanced=enhance(source);selected=output.resolve(String.format("page-%04d.png",page.number));ImageIO.write(enhanced,"png",selected.toFile());status="preprocessed";repaired++;}
      jdbc.update("UPDATE paper_page SET normalized_object_key=?,quality_score=?,status=?,updated_at=NOW() WHERE paper_id=? AND page_number=?",selected.toString(),score,status,paperId,page.number);totalScore+=score;
    }
    return new Summary(pages.size(),repaired,pages.isEmpty()?0:totalScore/pages.size());
  }

  private Metrics measure(BufferedImage image){long sum=0,sumSq=0,edge=0,count=0;int step=Math.max(1,Math.min(image.getWidth(),image.getHeight())/500);for(int y=step;y<image.getHeight();y+=step)for(int x=step;x<image.getWidth();x+=step){int value=gray(image.getRGB(x,y));int left=gray(image.getRGB(x-step,y));int top=gray(image.getRGB(x,y-step));sum+=value;sumSq+=(long)value*value;edge+=Math.abs(value-left)+Math.abs(value-top);count++;}double mean=count==0?0:(double)sum/count;double variance=count==0?0:(double)sumSq/count-mean*mean;return new Metrics(mean,Math.sqrt(Math.max(0,variance)),count==0?0:(double)edge/(count*2));}
  private int score(BufferedImage image,Metrics m){int resolution=Math.min(100,Math.round(image.getWidth()*100f/1400));int contrast=Math.min(100,(int)Math.round(m.contrast*2.4));int sharpness=Math.min(100,(int)Math.round(m.sharpness*5));int exposure=m.mean<45||m.mean>245?45:100;return Math.max(0,Math.min(100,(resolution*25+contrast*30+sharpness*30+exposure*15)/100));}
  private BufferedImage enhance(BufferedImage source){double scale=source.getWidth()<1400?Math.min(2d,1400d/source.getWidth()):1d;int width=(int)Math.round(source.getWidth()*scale),height=(int)Math.round(source.getHeight()*scale);BufferedImage result=new BufferedImage(width,height,BufferedImage.TYPE_BYTE_GRAY);Graphics2D g=result.createGraphics();g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.drawImage(source,0,0,width,height,null);g.dispose();return result;}
  private int gray(int rgb){return (int)Math.round(((rgb>>16)&255)*.299+((rgb>>8)&255)*.587+(rgb&255)*.114);}
  private static final class Page{final int number;final Path path;Page(int number,Path path){this.number=number;this.path=path;}}
  private static final class Metrics{final double mean,contrast,sharpness;Metrics(double mean,double contrast,double sharpness){this.mean=mean;this.contrast=contrast;this.sharpness=sharpness;}}
  public static final class Summary{public final int pages,repaired,averageScore;Summary(int pages,int repaired,int averageScore){this.pages=pages;this.repaired=repaired;this.averageScore=averageScore;}}
}
