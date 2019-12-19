var MouseControls = function() 
{
    this.x = 0;
    this.y = 0;
    var that = this;

    this.initialize = function(element) 
    {
        $(element).on("mousemove", function(event)  
        {
            that.x = event.pageX;
            that.y = event.pageY;
        });
    }
}