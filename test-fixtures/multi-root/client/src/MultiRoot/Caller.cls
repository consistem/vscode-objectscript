Class MultiRoot.Caller Extends %RegisteredObject
{

ClassMethod Test()
{
    Do ##class(MultiRoot.Shared).Ping()
    Do ##class(MultiRoot.ServerOnly).Ping()
}

}
